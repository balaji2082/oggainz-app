import { Bone, PageHead } from "@/components/Bits";

export default function AccountLoading() {
  return (
    <>
      <PageHead icon="user" title="Profile" subtitle="Your details, kept in check by us." />
      <Bone h={96} r="var(--og-r-lg)" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <Bone key={i} h={62} r="var(--og-r-md)" />
        ))}
      </div>
      <div className="mt-6">
        <Bone h={150} r="var(--og-r-lg)" />
      </div>
    </>
  );
}
