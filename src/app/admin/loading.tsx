export default function AdminLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-40 animate-pulse rounded-[32px] border border-[#ead9c8] bg-[#fffaf2]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
        <div className="h-72 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
      </div>
    </div>
  );
}
