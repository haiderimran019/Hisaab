/* Calendar files are local. Importing into a calendar is the user's decision. */
import {schedule} from './deadlines';
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function reminderCalendar(year:number,today:string){
 const next=new Date(today+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1,1);const day=next.toISOString().slice(0,10).replaceAll('-','');
 const events=[['monthly-statements',day,'Import your monthly bank statement','Open Hisaab and import your statement CSV. Review and classify each line. Never share banking passwords.','RRULE:FREQ=MONTHLY;BYMONTHDAY=1'],...schedule(year,today).filter(s=>s.universal&&s.daysAway>=0).map(s=>[s.id,s.date.replaceAll('-',''),`${s.label} · TY ${year}`,`${s.law}. ${s.note} Check FBR for extensions before relying on this statutory date.`, ''])];
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hisaab//Local reminders//EN','CALSCALE:GREGORIAN',...events.flatMap(([id,date,title,note,repeat])=>['BEGIN:VEVENT',`UID:${id}-${year}@hisaab.local`,`DTSTAMP:${today.replaceAll('-','')}T000000Z`,`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${escape(title)}`,`DESCRIPTION:${escape(note)}`,repeat,'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:${escape(title)}`,'END:VALARM','END:VEVENT'].filter(Boolean)),'END:VCALENDAR'].join('\r\n')+'\r\n';
}
