import s from "./guides.module.css"

// Side-by-side table used by the "Hielda vs ..." comparison pages.
// rows: [{ label, a, b }] where a/b are strings or nodes; a boolean
// renders as a tick or a cross.
const cell = (v) => (v === true ? <span className={s.cmpYes}>Yes</span> : v === false ? <span className={s.cmpNo}>No</span> : v)

export default function CompareTable({ colA, colB, rows }) {
  return (
    <div className={s.cmpWrap}>
      <table className={s.cmp}>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">{colA}</th>
            <th scope="col">{colB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{cell(r.a)}</td>
              <td>{cell(r.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
