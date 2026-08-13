import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Parser, Store, DataFactory, Quad } from 'n3';
import * as fs from 'fs';
import * as path from 'path';
import {
  RDF_TYPE,
  RDFS_LABEL,
  RDFS_COMMENT,
  RDFS_SUBCLASSOF,
  RDFS_DOMAIN,
  RDFS_RANGE,
  OWL_CLASS,
  OWL_OBJECT_PROPERTY,
  OWL_DATATYPE_PROPERTY,
} from './ontology.constants';

const { namedNode } = DataFactory;

export interface TraversalStep {
  subject: string;
  subjectLabel: string;
  predicate: string;
  predicateLabel: string;
  object: string;
  objectLabel: string;
}

/**
 * OntologyGraphService: the "Runtime Knowledge Graph" layer.
 *
 * This is the load-bearing piece that makes this whole system genuinely
 * ontology-driven rather than "ontology as documentation": at boot it
 * parses BOTH .ttl files (ROO-core + Gajo domain) with a real RDF parser
 * (n3.js) into a single in-memory RDF/JS Store, and every other backend
 * service (RuntimeContextService, SemanticPlannerService,
 * RecommendationService, PolicyRuleService, ...) queries THIS store via
 * `query()` / `traverse()` / `expand()` instead of hardcoding business
 * rules in TypeScript.
 *
 * Any change to the .ttl source files (new HealthCondition, new
 * semanticallyExpandsTo edge, new Program suitability, ...) is picked up
 * automatically on next boot with zero code change required elsewhere.
 */
@Injectable()
export class OntologyGraphService implements OnModuleInit {
  private readonly logger = new Logger(OntologyGraphService.name);
  private store = new Store();
  private ttlSource = '';

  onModuleInit() {
    const files = ['runtime_core_v1_0.ttl', 'gajo_ai_concierge_domain_v1_0.ttl'];
    const candidates = [path.join(__dirname, '..', 'ontology-data'), path.join(process.cwd(), 'src', 'ontology-data'), path.join(process.cwd(), 'server', 'src', 'ontology-data')];
    const dataDir = candidates.find((dir) => files.every((file) => fs.existsSync(path.join(dir, file))));
    if (!dataDir) throw new Error(`Ontology files not found in: ${candidates.join(', ')}`);
    let totalQuads = 0;
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      this.ttlSource += `\n# === ${file} ===\n${content}\n`;
      const parser = new Parser();
      const quads = parser.parse(content);
      this.store.addQuads(quads);
      totalQuads += quads.length;
    }
    if (totalQuads === 0) throw new Error(`Ontology loaded zero RDF triples from ${dataDir}`);
    this.logger.log(
      `Loaded Runtime Operational Ontology: ${totalQuads} RDF triples from ${files.length} TTL files into in-memory graph`,
    );
  }

  /** Raw concatenated Turtle source (used by the Ontology Explorer "raw graph" tab). */
  getRawTurtle(): string {
    return this.ttlSource;
  }

  /** Human-readable label for any URI (falls back to the local name after # or last /). */
  label(uri: string | null | undefined): string {
    if (!uri) return '';
    const quads = this.store.getQuads(namedNode(uri), namedNode(RDFS_LABEL), null, null);
    const ko = quads.find((q) => q.object.termType === 'Literal' && (q.object as any).language === 'ko');
    if (ko) return ko.object.value;
    if (quads.length) return quads[0].object.value;
    const hash = uri.split('#').pop();
    const slash = uri.split('/').pop();
    return hash || slash || uri;
  }

  /** rdfs:comment / roo:description text for a URI, if any. */
  description(uri: string): string | undefined {
    const quads = this.store.getQuads(namedNode(uri), namedNode(RDFS_COMMENT), null, null);
    if (quads.length) return quads[0].object.value;
    const descPred = 'https://linkeddata.center/roo-core#description';
    const q2 = this.store.getQuads(namedNode(uri), namedNode(descPred), null, null);
    if (q2.length) return q2[0].object.value;
    return undefined;
  }

  /** Generic SPARQL-like triple-pattern query. null = wildcard. */
  query(subject: string | null, predicate: string | null, object: string | null) {
    const quads = this.store.getQuads(
      subject ? namedNode(subject) : null,
      predicate ? namedNode(predicate) : null,
      object ? namedNode(object) : null,
      null,
    );
    return quads.map((q) => ({
      subject: q.subject.value,
      predicate: q.predicate.value,
      object: q.object.value,
    }));
  }

  /** All literal datatype-property values attached to a subject (age, isIndoor, durationMinutes, ...). */
  literalProps(subject: string): Record<string, string> {
    const quads = this.store.getQuads(namedNode(subject), null, null, null);
    const out: Record<string, string> = {};
    for (const q of quads) {
      if (q.object.termType === 'Literal') {
        const localPred = q.predicate.value.split('#').pop() || q.predicate.value;
        out[localPred] = q.object.value;
      }
    }
    return out;
  }

  /** All object-property edges (URI -> URI) attached to a subject, grouped by predicate local name. */
  objectProps(subject: string): Record<string, string[]> {
    const quads = this.store.getQuads(namedNode(subject), null, null, null);
    const out: Record<string, string[]> = {};
    for (const q of quads) {
      if (q.object.termType === 'NamedNode') {
        const localPred = q.predicate.value.split('#').pop() || q.predicate.value;
        out[localPred] = out[localPred] || [];
        out[localPred].push(q.object.value);
      }
    }
    return out;
  }

  /** All individuals (instances) of a given rdf:type class URI (exact type only, no subclass reasoning). */
  individualsOf(classUri: string): string[] {
    return this.store
      .getQuads(null, namedNode(RDF_TYPE), namedNode(classUri), null)
      .map((q) => q.subject.value);
  }

  /** Every class URI that is classUri itself or a (transitive) rdfs:subClassOf descendant of it. */
  subclassClosure(classUri: string): string[] {
    const closure = new Set<string>([classUri]);
    let frontier = [classUri];
    while (frontier.length) {
      const next: string[] = [];
      for (const c of frontier) {
        // find X such that X rdfs:subClassOf c
        const children = this.store.getQuads(null, namedNode(RDFS_SUBCLASSOF), namedNode(c), null);
        for (const q of children) {
          if (!closure.has(q.subject.value)) {
            closure.add(q.subject.value);
            next.push(q.subject.value);
          }
        }
      }
      frontier = next;
    }
    return Array.from(closure);
  }

  /**
   * All individuals whose rdf:type is classUri OR any subclass of classUri
   * (since this graph does not run full OWL reasoning, plain rdf:type
   * lookups miss individuals typed only as a subclass, e.g. an individual
   * typed gajo:HotSpringFacility would be missed by individualsOf(Facility)).
   */
  individualsOfIncludingSubclasses(classUri: string): string[] {
    const classes = this.subclassClosure(classUri);
    const set = new Set<string>();
    for (const c of classes) {
      for (const uri of this.individualsOf(c)) set.add(uri);
    }
    return Array.from(set);
  }

  /** rdf:type(s) of a given individual. */
  typesOf(individualUri: string): string[] {
    return this.store
      .getQuads(namedNode(individualUri), namedNode(RDF_TYPE), null, null)
      .map((q) => q.object.value);
  }

  /**
   * Breadth-first traversal along `predicate` starting at `startUri`, up to
   * `maxDepth` hops, collecting every edge walked as an explainable step.
   * This is what powers "explainable recommendation" evidence paths: e.g.
   * walking roo:semanticallyExpandsTo from a HealthCondition individual.
   */
  traverse(startUri: string, predicate: string, maxDepth = 3): TraversalStep[] {
    const visited = new Set<string>([startUri]);
    const steps: TraversalStep[] = [];
    let frontier = [startUri];
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next: string[] = [];
      for (const subj of frontier) {
        const quads = this.store.getQuads(namedNode(subj), namedNode(predicate), null, null);
        for (const q of quads) {
          const obj = q.object.value;
          steps.push({
            subject: subj,
            subjectLabel: this.label(subj),
            predicate,
            predicateLabel: this.label(predicate),
            object: obj,
            objectLabel: this.label(obj),
          });
          if (!visited.has(obj)) {
            visited.add(obj);
            next.push(obj);
          }
        }
      }
      frontier = next;
    }
    return steps;
  }

  /**
   * Semantic expansion helper: given one or more "condition-like" individuals
   * (HealthCondition / WeatherCondition / CongestionCondition individuals),
   * follow roo:semanticallyExpandsTo to discover the derived conditions,
   * risks and preferences they imply. This is the core mechanism described
   * in the prompt's example: KneePain -> ShortWalkingDistance / FallRisk.
   */
  expand(startUris: string[]): { expanded: string[]; steps: TraversalStep[] } {
    const expandedSet = new Set<string>();
    const allSteps: TraversalStep[] = [];
    for (const uri of startUris) {
      const steps = this.traverse(uri, 'https://linkeddata.center/roo-core#semanticallyExpandsTo', 3);
      for (const s of steps) {
        expandedSet.add(s.object);
        allSteps.push(s);
      }
    }
    return { expanded: Array.from(expandedSet), steps: allSteps };
  }

  /** All classes (owl:Class individuals) with label/comment/superclass, for the Ontology Explorer. */
  listClasses() {
    const classQuads = this.store.getQuads(null, namedNode(RDF_TYPE), namedNode(OWL_CLASS), null);
    return classQuads.map((q) => {
      const uri = q.subject.value;
      const superClasses = this.store
        .getQuads(namedNode(uri), namedNode(RDFS_SUBCLASSOF), null, null)
        .map((s) => s.object.value);
      return {
        uri,
        label: this.label(uri),
        comment: this.description(uri),
        subClassOf: superClasses,
        subClassOfLabels: superClasses.map((s) => this.label(s)),
      };
    });
  }

  /** All object + datatype properties, with domain/range, for the Ontology Explorer. */
  listProperties() {
    const objProps = this.store.getQuads(null, namedNode(RDF_TYPE), namedNode(OWL_OBJECT_PROPERTY), null);
    const dataProps = this.store.getQuads(null, namedNode(RDF_TYPE), namedNode(OWL_DATATYPE_PROPERTY), null);
    const toEntry = (uri: string, kind: 'object' | 'datatype') => {
      const domain = this.store.getQuads(namedNode(uri), namedNode(RDFS_DOMAIN), null, null)[0]?.object.value;
      const range = this.store.getQuads(namedNode(uri), namedNode(RDFS_RANGE), null, null)[0]?.object.value;
      return {
        uri,
        label: this.label(uri),
        kind,
        domain,
        domainLabel: domain ? this.label(domain) : undefined,
        range,
        rangeLabel: range ? this.label(range) : undefined,
      };
    };
    return [
      ...objProps.map((q) => toEntry(q.subject.value, 'object' as const)),
      ...dataProps.map((q) => toEntry(q.subject.value, 'datatype' as const)),
    ];
  }

  /** All named individuals: anything with an rdf:type that is itself NOT an owl:Class/Property meta-type. */
  listIndividuals() {
    const metaTypes = new Set([
      OWL_CLASS,
      OWL_OBJECT_PROPERTY,
      OWL_DATATYPE_PROPERTY,
      'http://www.w3.org/2002/07/owl#Ontology',
    ]);
    const typeQuads = this.store.getQuads(null, namedNode(RDF_TYPE), null, null);
    const seen = new Map<string, { uri: string; label: string; types: string[]; typeLabels: string[] }>();
    for (const q of typeQuads) {
      if (metaTypes.has(q.object.value)) continue;
      const uri = q.subject.value;
      if (!seen.has(uri)) {
        seen.set(uri, { uri, label: this.label(uri), types: [], typeLabels: [] });
      }
      const entry = seen.get(uri)!;
      entry.types.push(q.object.value);
      entry.typeLabels.push(this.label(q.object.value));
    }
    return Array.from(seen.values());
  }

  get size(): number {
    return this.store.size;
  }
}
