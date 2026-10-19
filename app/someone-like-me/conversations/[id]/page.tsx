import Link from "next/link";
import { AppNav,BrandBar } from "@/components/AppNav";
import { SlmConversation } from "@/components/SlmConversation";
export default async function ConversationPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <main className="pb-24"><BrandBar/><div className="mx-auto max-w-xl px-4 py-6"><Link href="/someone-like-me/connections" className="mb-4 inline-block text-sm text-[#fff4ee] underline">Back to introductions</Link><SlmConversation key={id} id={id}/></div><AppNav/></main>;
}
