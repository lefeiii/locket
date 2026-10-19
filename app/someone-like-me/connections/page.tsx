import Link from "next/link";
import { AppNav,BrandBar } from "@/components/AppNav";
import { SlmConnections } from "@/components/SlmConnections";
export default function ConnectionsPage(){return <main className="pb-24"><BrandBar/><div className="mx-auto max-w-lg px-4 py-6"><Link href="/someone-like-me" className="mb-4 inline-block text-sm text-[#fff4ee] underline">Back to Someone Like Me</Link><SlmConnections/></div><AppNav/></main>;}
