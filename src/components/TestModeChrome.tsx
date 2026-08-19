import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useStore } from '../data/store'
import { isTestMode, mayUseTestMode, setTestMode } from '../data/testMode'

/**
 * The stamp that says you are not looking at the camp.
 *
 * Test mode is a whole parallel log, and the screens it draws are pixel-
 * identical to the real ones — so without a persistent mark it is only a
 * matter of time before someone awards a real key into the sandbox, or
 * worse, believes a sandbox score is real. It sits in the opposite corner
 * from the sync badge and takes a tap back to the switch.
 */
export default function TestModeChrome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { testMode } = useStore()

  /*
   * Self-healing: the flag is device-wide, so signing out and handing the
   * phone to a helper would otherwise leave them in a sandbox they cannot
   * see the switch for. Anyone not allowed test mode gets dropped back onto
   * the real log automatically.
   */
  useEffect(() => {
    if (isTestMode() && !mayUseTestMode(user)) setTestMode(false)
  }, [user])

  if (!testMode) return null

  return (
    <button
      onClick={() => navigate('/test')}
      aria-label="Test mode — open the sandbox switch"
      className="font-mono fixed left-2 z-50 uppercase"
      style={{
        top: 'calc(8px + env(safe-area-inset-top))',
        padding: '4px 8px',
        fontSize: 8.5,
        letterSpacing: '0.14em',
        borderRadius: 3,
        color: 'var(--color-lamp-hot)',
        background: 'linear-gradient(180deg, #3a2410 0%, #241607 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(254,223,151,0.24), 0 1px 3px rgba(0,0,0,0.55)',
      }}
    >
      ⚙ test mode
    </button>
  )
}
