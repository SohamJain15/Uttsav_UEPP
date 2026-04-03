const ReviewCard = ({ title, items = [] }) => {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-[#0F172A]">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
            <p className="text-sm text-[#64748B]">{item.label}</p>
            <p className="text-right text-sm font-medium text-[#0F172A]">{item.value || "-"}</p>
          </div>
        ))}
      </div>
    </article>
  );
};

export default ReviewCard;
