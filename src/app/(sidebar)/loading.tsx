import { PageSkeleton } from "@/components/page-skeleton";

// Rendered inside the sidebar layout's content area, so the sidebar and header
// stay put and only the page body shows the skeleton.
export default function Loading() {
  return (
    <div className="px-4 py-4 lg:px-6">
      <PageSkeleton tiles={4} cards={2} />
    </div>
  );
}
