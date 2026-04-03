const Toast = ({ message, tone = 'success' }) => {
  const toneClass = tone === 'success' ? 'border-statusGreen/40 text-statusGreen' : 'border-statusRed/40 text-statusRed';

  return (
    <div className={`fixed right-6 top-6 z-50 rounded-xl border bg-cardBg px-4 py-3 text-sm font-semibold shadow-card ${toneClass}`}>
      {message}
    </div>
  );
};

export default Toast;
