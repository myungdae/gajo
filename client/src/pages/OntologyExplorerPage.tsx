import { useEffect, useState } from 'react';
import {
  expandOntology,
  fetchOntologyClasses,
  fetchOntologyIndividuals,
  fetchOntologyProperties,
} from '../api/client';
import { shortUri } from '../utils/uri';

type Tab = 'classes' | 'properties' | 'individuals' | 'expand';

export default function OntologyExplorerPage() {
  const [tab, setTab] = useState<Tab>('classes');
  const [classes, setClasses] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandUri, setExpandUri] = useState('https://gajo-wellness.kr/ontology#kneePain');
  const [expandResult, setExpandResult] = useState<any>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchOntologyClasses(), fetchOntologyProperties(), fetchOntologyIndividuals()])
      .then(([c, p, i]) => {
        setClasses(c);
        setProperties(p);
        setIndividuals(i);
      })
      .finally(() => setLoading(false));
  }, []);

  const runExpand = async () => {
    setExpandLoading(true);
    try {
      const res = await expandOntology([expandUri]);
      setExpandResult(res);
    } catch (e) {
      setExpandResult({ error: String(e) });
    } finally {
      setExpandLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>온톨로지 탐색기</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          ROO-Core + 가조 도메인 온톨로지(.ttl)를 서버 부팅 시 메모리에 로드한 실제 RDF 그래프를
          직접 조회합니다. 이것이 이 서비스의 모든 추천/추론의 유일한 원천입니다.
        </p>
        <div className="tag-row">
          {(['classes', 'properties', 'individuals', 'expand'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`badge ${tab === t ? '' : 'muted'}`}
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => setTab(t)}
            >
              {t === 'classes' ? '클래스' : t === 'properties' ? '속성' : t === 'individuals' ? '개체' : '그래프 확장'}
            </button>
          ))}
        </div>
      </div>

      {loading && tab !== 'expand' ? (
        <div className="loading">불러오는 중...</div>
      ) : (
        <>
          {tab === 'classes' && (
            <div className="card">
              <h2>클래스 ({classes.length})</h2>
              {classes.map((c: any) => (
                <div key={c.uri} className="evidence-item">
                  <b>{c.label || shortUri(c.uri)}</b> — {shortUri(c.uri)}
                </div>
              ))}
            </div>
          )}

          {tab === 'properties' && (
            <div className="card">
              <h2>속성 ({properties.length})</h2>
              {properties.map((p: any) => (
                <div key={p.uri} className="evidence-item">
                  <b>{p.label || shortUri(p.uri)}</b> — {shortUri(p.uri)}
                </div>
              ))}
            </div>
          )}

          {tab === 'individuals' && (
            <div className="card">
              <h2>개체 ({individuals.length})</h2>
              {individuals.map((i: any) => (
                <div key={i.uri} className="evidence-item">
                  <b>{i.label || shortUri(i.uri)}</b> — {shortUri(i.uri)}
                </div>
              ))}
            </div>
          )}

          {tab === 'expand' && (
            <div className="card">
              <h2>semanticallyExpandsTo 그래프 확장 테스트</h2>
              <div className="field">
                <label>시작 URI</label>
                <input value={expandUri} onChange={(e) => setExpandUri(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" onClick={runExpand} disabled={expandLoading}>
                {expandLoading ? '탐색 중...' : '그래프 확장 실행'}
              </button>
              {expandResult && (
                <div style={{ marginTop: 12 }}>
                  {expandResult.error ? (
                    <p style={{ color: 'var(--color-danger)' }}>{expandResult.error}</p>
                  ) : (
                    <>
                      <b style={{ fontSize: 12 }}>확장된 조건</b>
                      <div className="tag-row">
                        {(expandResult.expanded || []).map((e: string) => (
                          <span className="badge" key={e}>
                            {shortUri(e)}
                          </span>
                        ))}
                      </div>
                      <b style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                        추적된 RDF 경로
                      </b>
                      {(expandResult.steps || []).map((s: any, idx: number) => (
                        <div className="evidence-item" key={idx}>
                          {shortUri(s.subject)} → {shortUri(s.object)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
