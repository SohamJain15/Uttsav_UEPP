const DecisionChecklist = ({ checklistItems }) => {
  const unresolvedItems = checklistItems.filter((item) => !item.complete);

  return (
    <div className="mt-4 rounded-xl border border-borderMain bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-textMain">Decision Checklist</h4>
      <div className="mt-2 space-y-2">
        {checklistItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                item.complete ? 'bg-statusGreen' : 'bg-statusYellow'
              }`}
            />
            <span className={item.complete ? 'text-textMain' : 'text-statusYellow font-semibold'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {unresolvedItems.length ? (
        <p className="mt-3 text-xs font-semibold text-statusYellow">
          Pending checks: {unresolvedItems.map((item) => item.label).join(', ')}
        </p>
      ) : (
        <p className="mt-3 text-xs font-semibold text-statusGreen">All key checks reviewed.</p>
      )}
    </div>
  );
};

export default DecisionChecklist;
