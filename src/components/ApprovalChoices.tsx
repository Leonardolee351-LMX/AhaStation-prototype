import { useWorkspace } from '../store'
import type { Approval } from '../types'

const MARKS = ['A', 'B', 'C', 'D', 'E', 'F']

export function ApprovalChoices({ approval }: { approval: Approval }) {
  const { dispatch } = useWorkspace()
  if (!approval.options?.length) return null
  return (
    <ul className="aha-option-list">
      {approval.options.map((option, index) => (
        <li key={option.id}>
          <button
            type="button"
            className="aha-choice aha-choice-pick"
            onClick={() =>
              dispatch({
                type: 'resolve-approval',
                approvalId: approval.id,
                decision: 'approved',
                optionId: option.id,
              })
            }
          >
            <span className="aha-choice-mark">{MARKS[index] ?? String(index + 1)}</span>
            <span className="aha-choice-body">
              <strong>{option.label}</strong>
              {option.description ? <em>{option.description}</em> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function hasApprovalChoices(approval: Approval) {
  return Boolean(approval.options?.length)
}
