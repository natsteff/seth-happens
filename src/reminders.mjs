// Uses active run time, so pauses do not consume the five-second grace period.
export class SummitReminder{
 arrivedAt=null;shown=false;
 update(now,{home,ready,finished,beer,missed,mobile}){
  if(finished)return null;
  if(home&&this.arrivedAt===null)this.arrivedAt=now;
  if(!home||!ready||this.shown||this.arrivedAt===null||now-this.arrivedAt<5000)return null;
  this.shown=true;
  const delivery=beer?'Use Action to deliver the six-pack & finish':'Use Action to finish';
  return delivery+(missed?(mobile?'\nMissing photo: Menu → Recall missed photo':'\nMissing photo: press B to recall'): '');
 }
}
export const REMINDER_MS=1800;
