import { useState } from 'react';
import DecisionChecklist from './DecisionChecklist';

const baseButtonClass =
  'rounded-xl px-3 py-2 text-sm font-semibold transition hover:opacity-90';

const ActionPanel = ({
  role,
  currentStatus,
  riskLevel,
  checklistItems = [],
  onSubmitAction
}) => {
  const [comment, setComment] = useState('');
  const isHighRisk = riskLevel === 'High';

  const buttonOrder = isHighRisk
    ? [
        {
          key: 'query',
          label: 'Raise Query',
          className: `${baseButtonClass} bg-primary text-white`
        },
        {
          key: 'approve',
          label: 'Approve',
          className: `${baseButtonClass} border border-statusGreen text-statusGreen`
        },
        {
          key: 'reject',
          label: 'Reject',
          className: `${baseButtonClass} bg-statusRed text-white`
        }
      ]
    : [
        {
          key: 'approve',
          label: 'Approve',
          className: `${baseButtonClass} bg-statusGreen text-white`
        },
        {
          key: 'query',
          label: 'Raise Query',
          className: `${baseButtonClass} border border-primary text-primary`
        },
        {
          key: 'reject',
          label: 'Reject',
          className: `${baseButtonClass} bg-statusRed text-white`
        }
      ];

  const triggerAction = (action) => {
    onSubmitAction(action, comment);
    setComment('');
  };

  if (role === 'Admin') {
    return (
      <div className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
        <h3 className="text-base font-semibold text-textMain">Action Panel</h3>
        <p className="mt-2 text-sm text-textSecondary">
          Admin can monitor workflow but cannot issue department approvals.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-cardBg p-4 shadow-card ${
        isHighRisk ? 'border-statusRed/45' : 'border-borderMain'
      }`}
    >
      <h3 className="text-base font-semibold text-textMain">Action Panel</h3>
      <p className="mt-1 text-sm text-textSecondary">Current Status: {currentStatus}</p>

      {isHighRisk ? (
        <p className="mt-2 rounded-xl bg-statusRed/10 px-3 py-2 text-sm font-semibold text-statusRed">
          High-risk event: Query is prioritized before approval.
        </p>
      ) : null}

      <DecisionChecklist checklistItems={checklistItems} />

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={4}
        placeholder="Add comments for audit trail"
        className="mt-3 w-full rounded-xl border border-borderMain px-3 py-2 text-sm text-textMain outline-none ring-primary/30 focus:ring"
      />

      <div className="mt-4 grid grid-cols-1 gap-2">
        {buttonOrder.map((button) => (
          <button
            key={button.key}
            onClick={() => triggerAction(button.key)}
            className={button.className}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionPanel;
