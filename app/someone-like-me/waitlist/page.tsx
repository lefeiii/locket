import Link from "next/link";
import { SomeoneLikeMe as WaitlistPreferences } from "@/components/WaitlistPreferences";
export default function EarlierWaitlistPage(){return <main className="mx-auto max-w-lg px-4 py-8"><Link href="/someone-like-me" className="text-sm text-[#fff4ee] underline">Back to public story discovery</Link><p className="mt-4 rounded-2xl bg-[#fffaf8] p-4 text-sm leading-6 text-[#513940]">This is the earlier waitlist. These selections haven’t been reused for story discovery. You can remove them below. Private introductions remain disabled.</p><WaitlistPreferences/></main>;}
