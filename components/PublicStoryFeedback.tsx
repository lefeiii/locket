"use client";
import { useSlmRpc } from "@/lib/use-slm-rpc";
import { usePublicAction } from "@/components/SlmPublicShared";
import { slmButton } from "@/lib/someone-like-me";
export function PublicStoryFeedback({storyId}:{storyId:string}){
 const {data,reload}=useSlmRpc<{available:boolean;answer:string|null}>('slm_public_feedback_state',{story_uuid:storyId});const {busy,notice,act}=usePublicAction(reload);
 if(!data?.available)return null;
 return <section className="mt-5 rounded-3xl border border-[#ead4dc] bg-[#fff7f8] p-5 text-sm leading-6 text-[#513940]" aria-label="Someone Like Me feedback"><h2 className="font-serif text-xl">did this help you feel understood?</h2><p className="mt-2">Optional and private. The author won’t see your answer. We summarize responses to learn whether Someone Like Me helps.</p><div className="mt-3 flex flex-wrap gap-2">{[['yes','Yes'],['somewhat','A little'],['no','Not really']].map(([choice,label])=><button key={choice} type="button" className={slmButton} aria-pressed={data.answer===choice} disabled={busy} onClick={()=>act('slm_public_feedback_save',{story_uuid:storyId,choice},'Thank you. Your feedback is saved privately.')}>{label}</button>)}</div>{notice&&<p className="mt-3" role="status">{notice}</p>}</section>;
}
