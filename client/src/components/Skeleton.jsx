// FILE: Skeleton.jsx
// PATH: client/src/components/Skeleton.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: লোড হওয়ার সময় ধূসর ঝিলিক-বক্স। ব্যবহার: <Skeleton h={20} w="60%" />, <SkeletonCard />, <SkeletonGrid count={6} />

export default function Skeleton({ w = '100%', h = 16, r, style }) {
  return <div className="skeleton" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="pcard" aria-hidden="true">
      <div className="pcard-cover skeleton" />
      <Skeleton h={13} />
      <Skeleton h={13} w="55%" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
