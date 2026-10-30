// Uses active run time, so pauses do not consume the five-second grace period.
export class SummitReminder{
 arrivedAt=null;shown=false;
 update(now,{home,ready,finished,beer,missed,mobile}){
  if(finished)return null;
  if(home&&this.arrivedAt===null)this.arrivedAt=now;
  if(!beer||!home||!ready||this.shown||this.arrivedAt===null||now-this.arrivedAt<5000)return null;
  this.shown=true;
  const delivery=beer?'Use Action to deliver the six-pack & finish':'Return to Floor 12 for the beer';
  return delivery+(missed?'\nMissing photo: choose delivery or Recall at the door': '');
 }
}
export const REMINDER_MS=1800;
