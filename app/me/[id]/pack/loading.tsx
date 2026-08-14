import { Bone, PageHead } from "@/components/Bits";

export default function PackLoading() {
  return (
    <>
      <PageHead
        icon="pack"
        title="Your pack"
        subtitle="What's in every meal, and how many you have left."
      />
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5"
          >
            <div className="flex items-start gap-4">
              <Bone h={72} w={72} r="999px" />
              <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                <Bone h={18} w="65%" />
                <Bone h={13} w="45%" />
                <Bone h={14} w="55%" />
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-[var(--og-border)] pt-4">
              <Bone h={13} w="35%" />
              <Bone h={14} w="80%" />
              <Bone h={14} w="70%" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
