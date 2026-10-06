import type {Lang} from './content';
export const AVATAR_WARNING_SECONDS=30;
/** Interface language; independent of the conversation language. */
export const sessionMessages:Record<Lang,{warning:string;timeTitle:string;idleTitle:string;timeEnded:string;idleEnded:string;videoTimeEnded:string;videoIdleEnded:string}>={
 ar:{
  warning:'بقي أقل من ٣٠ ثانية لاتصال الشخصية. نحدّ الاتصال بخمس دقائق للحفاظ على رصيد الخدمة.',
  timeTitle:'انتهى وقت الشخصية',idleTitle:'أُغلقت الشخصية لعدم النشاط',
  timeEnded:'وصل اتصال الشخصية إلى حد الخمس دقائق للحفاظ على الرصيد. يبقى نص الحوار متاحًا هنا؛ يمكنك المتابعة بالكتابة أو إنهاء المناقشة ومراجعتها.',
  idleEnded:'أُغلق اتصال الشخصية بعد دقيقتين ونصف دون نشاط للحفاظ على الرصيد. يبقى نص الحوار متاحًا هنا؛ يمكنك المتابعة بالكتابة أو مراجعته.',
  videoTimeEnded:'انتهى اتصال الفيديو عند حد الخمس دقائق للحفاظ على الرصيد. يمكنك الآن مراجعة النص المتاح للمحادثة.',
  videoIdleEnded:'أُغلق اتصال الفيديو بعد دقيقتين ونصف دون نشاط للحفاظ على الرصيد. يمكنك مراجعة النص المتاح للمحادثة.'
 },
 en:{
  warning:'Less than 30 seconds of avatar connection time remain. Connections are capped at five minutes to conserve service credits.',
  timeTitle:'Avatar time ended',idleTitle:'Avatar closed due to inactivity',
  timeEnded:'The avatar connection reached its five-minute limit to conserve credits. Your transcript remains available here; continue typing or end the discussion and review it.',
  idleEnded:'The avatar connection closed after 2½ minutes without activity to conserve credits. Your transcript remains available here; continue typing or review it.',
  videoTimeEnded:'The video connection ended at its five-minute limit to conserve credits. You can now review the available conversation transcript.',
  videoIdleEnded:'The video connection closed after 2½ minutes without activity to conserve credits. You can review the available conversation transcript.'
 }
};
