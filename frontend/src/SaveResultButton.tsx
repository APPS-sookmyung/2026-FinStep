import { useContext, useState } from 'react'
import { ArrowRight, BookmarkCheck } from 'lucide-react'
import { ArchiveNavigation } from './navigation-context'
import { apiJson } from './api'
import { useAuth } from './auth-context'

export default function SaveResultButton({ sessionId }: { sessionId: string }) {
  const auth = useAuth()
  const openArchive = useContext(ArchiveNavigation)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (!auth.user) { auth.openLogin(); return }
    setBusy(true); setError('')
    try {
      await apiJson('/api/results', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : '결과를 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return (
    <section className="save-result-card" aria-label="결과 저장">
      <h2><BookmarkCheck size={22} /> {saved ? '다시 돌아볼 수 있도록 보관했어요' : '이번 대응을 기록으로 남겨보세요'}</h2>
      <p>{auth.user ? '저장하면 다시 로그인해도 내 보관함에서 결과와 대화 기록을 확인할 수 있어요.' : '로그인한 뒤 저장 버튼을 눌러주세요. 현재 결과는 이 화면에서 유지돼요.'}</p>
      <button type="button" className="primary-button" disabled={busy || saved || auth.loading} onClick={() => { void save() }}>
        {saved ? '보관함에 저장됨' : busy ? '저장 중…' : auth.user ? '보관함에 저장' : '로그인하고 저장하기'}
      </button>
      {saved && <><p role="status">점수와 행동별 근거, 대화 기록을 보관함에서 다시 확인할 수 있어요.</p><button type="button" className="secondary-button" onClick={openArchive}>내 보관함으로 이동 <ArrowRight size={16} /></button></>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  )
}
