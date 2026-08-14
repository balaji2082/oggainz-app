import { Bone, PageHead } from "@/components/Bits";

export default function SupportLoading() {
  return (
    <>
      <PageHead
        icon="chat"
        title="Support"
        subtitle="Anything about your pack, delivery or the food."
      />
      <Bone h={52} r="var(--og-r-md)" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <Bone key={i} h={76} r="var(--og-r-md)" />
        ))}
      </div>
    </>
  );
}
