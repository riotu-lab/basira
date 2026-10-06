/** Remove provider annotations, never treat them as spoken learner evidence.
 * Keep ordinary punctuation/markup and the original words outside known blocks.
 */
export function spokenText(value:string):string {
 return value
  .replace(/<(user_audio_analysis|user_video_analysis|user_visual_analysis)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'')
  .replace(/<\/(?:user_audio_analysis|user_video_analysis|user_visual_analysis)\s*>/gi,'')
  .trim();
}
