import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { SomeoneLikeMe } from "@/components/SomeoneLikeMe";
export default function SomeoneLikeMePage() {
  return <main className="pb-24"><BrandBar /><div className="mx-auto max-w-lg px-4 py-6"><Link href="/settings" className="text-sm text-[#fff4ee] underline">Back to settings</Link><SomeoneLikeMe /><Link href="/" className="block text-center text-sm text-[#fff4ee] underline">Back to feed</Link></div><AppNav /></main>;
}
