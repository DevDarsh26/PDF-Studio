import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1ea] text-[#0d1b3d] px-6 text-center">
      <h1 className="serif text-8xl font-normal mb-4">404</h1>
      <h2 className="serif text-4xl mb-4">Page not found</h2>
      <p className="text-[#4a5168] text-lg max-w-md mb-8">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#0d1b3d] text-[#f4f1ea] font-medium hover:bg-[#ffd84d] hover:text-[#0d1b3d] transition-colors"
      >
        Return to PDF Studio
      </Link>
    </div>
  );
}
