import { useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { trackEvent } from "../../posthog"
import s from "./guides.module.css"

// A copy-and-paste letter on a guide page. The text is plain text in the
// prerendered HTML, so a crawler reads the whole letter and a visitor can
// select it even if the clipboard API is blocked.
export default function LetterBlock({
  id,
  title,
  text,
  note,
  lang,
  copyLabel = "Copy letter",
  copiedLabel = "Copied",
  selectedLabel = "Selected: now copy it",
}) {
  // "idle" | "copied" | "selected"
  const [state, setState] = useState("idle")
  const bodyRef = useRef(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState("copied")
      trackEvent("template_letter_copied", { letter: id })
    } catch {
      // Clipboard blocked (permissions, an embedded browser, an unfocused
      // tab). Select the letter instead so one keypress finishes the job,
      // rather than failing with no feedback.
      const range = document.createRange()
      range.selectNodeContents(bodyRef.current)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      setState("selected")
    }
    setTimeout(() => setState("idle"), 3000)
  }

  return (
    <figure className={s.letter} id={id}>
      <figcaption className={s.letterHead}>
        <h3 className={s.letterTitle}>{title}</h3>
        <button type="button" onClick={copy} className={s.letterCopy} data-copied={state === "copied" || undefined}>
          {state === "copied" ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} />}
          {state === "copied" ? copiedLabel : state === "selected" ? selectedLabel : copyLabel}
        </button>
      </figcaption>
      <pre className={s.letterBody} lang={lang} ref={bodyRef}>{text}</pre>
      {note && <p className={s.letterNote}>{note}</p>}
    </figure>
  )
}
