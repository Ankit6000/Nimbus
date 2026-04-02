export default function PortalLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-40 animate-pulse rounded-[32px] border border-[#ead9c8] bg-[#fffaf2]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
        <div className="h-56 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-48 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
        <div className="h-48 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
        <div className="h-48 animate-pulse rounded-[28px] border border-[#ead9c8] bg-[#fffaf2]" />
      </div>
    </div>
  );
}
