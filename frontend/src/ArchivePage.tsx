import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, CalendarDays, ChevronLeft, ChevronRight, FolderOpen, RefreshCw } from 'lucide-react'
import { apiJson } from './api'
import DiagnosisReport, { ScoreValue } from './DiagnosisReport'
import type { DiagnosisReport as Report, RiskLevel } from './diagnosis'
import { useAuth } from './auth-context'

type SavedSummary = {
  id: string; scenario_title: string; risk_label: string; risk_level: RiskLevel; created_at: number
  score?: number | null; scoring_version?: string
}
type SavedDetail = SavedSummary & { result: Report }
const dateText = (stamp: number) => new Date(stamp * 1000).toLocaleString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
})
const PAGE_SIZE = 12

function UserArchive() {
  const [items, setItems] = useState<SavedSummary[]>([])
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SavedDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const lastItem = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiJson<{ items: SavedSummary[]; has_more: boolean }>(`/api/results?limit=${PAGE_SIZE}&offset=${offset}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        setItems(data.items); setHasMore(data.has_more); setError('')
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [offset, retry])
  useEffect(() => () => detailRequest.current?.abort(), [])
  useEffect(() => {
    if (detail) detailHeading.current?.focus()
  }, [detail])

  const showDetail = async (id: string) => {
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setSelectedId(id); setDetailLoading(true); setDetailError(''); setDetail(null)
    try {
      const data = await apiJson<SavedDetail>(`/api/results/${encodeURIComponent(id)}`, { signal: controller.signal })
      if (!controller.signal.aborted) setDetail(data)
    } catch (e) {
      if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : '결과를 불러오지 못했습니다.')
    } finally { if (!controller.signal.aborted) setDetailLoading(false) }
  }
  const backToList = () => {
    detailRequest.current?.abort()
    setSelectedId(null); setDetail(null); setDetailError(''); setDetailLoading(false)
    requestAnimationFrame(() => {
      const button = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find(item => item.dataset.resultId === lastItem.current)
      button?.focus()
    })
  }

  if (selectedId) return <section className="archive-detail-view" aria-busy={detailLoading}>
    <button type="button" className="back-button" onClick={backToList}><ArrowLeft size={17} /> 보관함 목록으로</button>
    {detailLoading && <div className="archive-state" role="status"><RefreshCw size={26} /><h2>저장한 대응을 불러오고 있어요</h2><p>점수와 당시 대화 기록을 준비하고 있어요.</p></div>}
    {detailError && <div className="archive-state" role="alert"><h2>결과를 불러오지 못했어요</h2><p>{detailError}</p><button className="secondary-button" onClick={() => { void showDetail(selectedId) }}><RefreshCw size={16} /> 이 결과 다시 불러오기</button></div>}
    {detail && <>
      <div className="archive-detail-heading"><div><span className="report-eyebrow">저장한 대응 돌아보기</span><h2 ref={detailHeading} tabIndex={-1}>{detail.scenario_title} 결과 리포트</h2></div><time dateTime={new Date(detail.created_at * 1000).toISOString()}><CalendarDays size={16} /> {dateText(detail.created_at)} 저장</time></div>
      <DiagnosisReport report={detail.result} />
      <div className="archive-detail-footer"><p>저장 당시의 결과예요. 이후 채점 기준이 바뀌어도 이 기록은 유지돼요.</p><button className="secondary-button" onClick={backToList}>다른 기록 살펴보기 <ArrowRight size={16} /></button></div>
    </>}
  </section>

  return <section className="archive-collection" aria-label="저장된 진단 목록" aria-busy={loading}>
    <div className="archive-collection-heading"><h2><Bookmark size={19} /> 저장한 리포트</h2><span>최근 저장 순{!loading && !error ? ` · 이 페이지 ${items.length}개` : ''}</span></div>
    {loading && <div className="archive-state" role="status"><RefreshCw size={26} /><h2>나의 대응 기록을 불러오고 있어요</h2><p>잠시만 기다려 주세요.</p></div>}
    {error && <div className="archive-state" role="alert"><h2>보관함을 불러오지 못했어요</h2><p>{error}</p><button className="secondary-button" onClick={() => { setError(''); setLoading(true); setRetry(retry + 1) }}><RefreshCw size={16} /> 다시 불러오기</button></div>}
    {!loading && !error && items.length === 0 && <div className="archive-state"><FolderOpen size={40} /><h2>{offset ? '이 페이지에 저장된 기록이 없어요' : '아직 저장한 리포트가 없어요'}</h2><p>시뮬레이션을 마친 뒤 ‘보관함에 저장’을 누르면<br />점수와 나의 대응 과정을 여기에서 다시 볼 수 있어요.</p></div>}
    {!loading && !error && <div className="archive-list report-archive-list" ref={listRef}>{items.map(item => (
      <button type="button" className={`archive-report-card tone-${item.risk_level}`} key={item.id} data-result-id={item.id} onClick={() => { lastItem.current = item.id; void showDetail(item.id) }}>
        <div className="archive-card-top"><span className="archive-scenario-label">금융 위험 시뮬레이션</span><Bookmark size={19} aria-hidden="true" /></div>
        <h3>{item.scenario_title}</h3>
        <span className="outcome-badge">{item.risk_label}</span>
        <div className="archive-card-score"><ScoreValue report={item} /><span>{item.scoring_version === 'behavior-v1' ? item.score == null ? '판단 자료 부족' : '대응 점수' : '저장 당시의 채점 결과'}</span></div>
        <div className="archive-card-bottom"><time dateTime={new Date(item.created_at * 1000).toISOString()}>{dateText(item.created_at)}</time><span>리포트 보기 <ArrowRight size={16} /></span></div>
      </button>
    ))}</div>}
    {!error && (items.length > 0 || offset > 0) && <nav className="archive-pagination" aria-label="보관함 페이지">
      <button type="button" className="account-button" disabled={offset === 0 || loading} onClick={() => { setLoading(true); setOffset(offset - PAGE_SIZE) }}><ChevronLeft size={16} /> 이전</button>
      <span aria-current="page">{offset / PAGE_SIZE + 1}페이지</span>
      <button type="button" className="account-button" disabled={!hasMore || loading} onClick={() => { setLoading(true); setOffset(offset + PAGE_SIZE) }}>다음 <ChevronRight size={16} /></button>
    </nav>}
  </section>
}

export default function ArchivePage() {
  const auth = useAuth()
  return <main className="archive-main report-archive-main">
    <header className="archive-page-heading"><span className="report-eyebrow">나의 금융 대응 기록</span><h1>진단 결과 보관함</h1><p>그때의 선택을 돌아보고,<br className="archive-mobile-break" /> 다음 대응을 더 단단하게 준비해 보세요.</p></header>
    {auth.loading ? <div className="archive-state" role="status">로그인 상태를 확인하고 있어요.</div> : auth.user ? <UserArchive key={auth.user.id} /> : (
      <section className="archive-state"><FolderOpen size={40} /><h2>나의 대응 기록을 한곳에</h2><p>로그인하면 저장해 둔 점수와 행동별 근거,<br />대화 기록을 다시 확인할 수 있어요.</p><button type="button" className="primary-button" onClick={auth.openLogin}>로그인하고 보관함 보기 <ArrowRight size={17} /></button></section>
    )}
  </main>
}
