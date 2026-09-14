import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <PageSkeleton />
    </div>
  );
}
