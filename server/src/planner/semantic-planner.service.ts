import { Injectable } from '@nestjs/common';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { CLASS } from '../ontology/ontology.constants';

export interface PlannedTask {
  taskUri: string;
  taskLabel: string;
  requiredCapabilities: string[];
  requiredCapabilityLabels: string[];
  assignedAgentUri?: string;
  assignedAgentLabel?: string;
}

/**
 * SemanticPlannerService: converts a RuntimeContext's selected
 * gajo:ConciergeOperation into an ordered list of roo:Task individuals
 * (via roo:hasTask), resolves each Task's roo:requiresCapability, and
 * selects the roo:ArtificialAgent to execute it — preferring the
 * ontology's own roo:assignedToAgent edge when present, falling back to
 * a capability-based agent search (roo:hasCapability) otherwise.
 *
 * This is the "Task Decomposition -> Agent Selection" step of the
 * architecture described in the prompt:
 *   Semantic Context -> Graph Traversal -> Task Decomposition -> Agent Selection
 */
@Injectable()
export class SemanticPlannerService {
  constructor(
    private readonly traversal: GraphTraversalService,
    private readonly graph: OntologyGraphService,
  ) {}

  planTasksForOperation(operationUri: string): PlannedTask[] {
    const opProps = this.traversal.objectProps(operationUri);
    const taskUris = opProps['hasTask'] || [];
    return taskUris.map((taskUri) => {
      const taskProps = this.traversal.objectProps(taskUri);
      const requiredCapabilities = taskProps['requiresCapability'] || [];
      let assignedAgentUri = (taskProps['assignedToAgent'] || [])[0];

      if (!assignedAgentUri && requiredCapabilities.length) {
        // fallback: capability-based agent search
        for (const cap of requiredCapabilities) {
          const candidates = this.traversal.findAgentsWithCapability(cap);
          if (candidates.length) {
            assignedAgentUri = candidates[0];
            break;
          }
        }
      }

      return {
        taskUri,
        taskLabel: this.traversal.label(taskUri),
        requiredCapabilities,
        requiredCapabilityLabels: requiredCapabilities.map((c) => this.traversal.label(c)),
        assignedAgentUri,
        assignedAgentLabel: assignedAgentUri ? this.traversal.label(assignedAgentUri) : undefined,
      };
    });
  }
}
