import { Bone } from "@/components/Bits";

export default function HomeLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Bone h={24} w="45%" />
        <Bone h={14} w="60%" />
      </div>

      {/* The hero meal card, at its real height. */}
      <Bone h={210} r="var(--og-r-lg)" />

      <div className="mt-8 space-y-3">
        <Bone h={12} w={90} />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Bone key={i} h={62} r="var(--og-r-md)" />
          ))}
        </div>
      </div>
    </>
  );
}
