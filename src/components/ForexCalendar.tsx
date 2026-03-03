import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Folder } from 'lucide-react';

type Event = {
  date: string;
  time: string;
  country: string;
  title: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
};

function groupEventsByDay(events: Event[]) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const grouped: { [key: string]: Event[] } = {};
  for (const day of days) grouped[day] = [];

  events.forEach(event => {
    const dateObj = new Date(event.date);
    const dayAbbr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    if (days.includes(dayAbbr)) {
      grouped[dayAbbr].push(event);
    }
  });

  return grouped;
}

function getFolderColor(event: Event) {
  const impact = event.impact.toLowerCase();
  const title = event.title.toLowerCase();

  if (title.includes('bank holiday')) return 'text-gray-400';
  if (impact === 'high') return 'text-red-500';
  if (impact === 'medium') return 'text-orange-400';
  return 'text-muted-foreground';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatNYTime(dateStr: string, timeStr: string) {
  if (!timeStr) return '';
  let hour = 0, minute = 0;

  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (ampmMatch) {
    hour = parseInt(ampmMatch[1], 10);
    minute = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3].toLowerCase();
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    const match = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
    } else {
      
      return '';
    }
  }

  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    d = new Date(`${dateStr}T00:00:00Z`);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('-');
    d = new Date(`${year}-${month}-${day}T00:00:00Z`);
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) {
   
    return '';
  }
  d.setUTCHours(hour, minute, 0, 0);

  const nyTime = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    hour12: true,
  });
  return nyTime;
}

const ForexCalendar: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchXML = async () => {
      const response = await fetch('/api/forex-calendar');
      const text = await response.text();

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      const eventElements = Array.from(xml.getElementsByTagName('event'));
      const parsedEvents: Event[] = eventElements.map((event) => ({
        date: event.getElementsByTagName('date')[0]?.textContent || '',
        time: event.getElementsByTagName('time')[0]?.textContent || '',
        country: event.getElementsByTagName('country')[0]?.textContent || '',
        title: event.getElementsByTagName('title')[0]?.textContent || '',
        impact: event.getElementsByTagName('impact')[0]?.textContent || '',
        forecast: event.getElementsByTagName('forecast')[0]?.textContent || '',
        previous: event.getElementsByTagName('previous')[0]?.textContent || '',
        actual: event.getElementsByTagName('actual')[0]?.textContent || '',
      }));

      const filteredEvents = parsedEvents.filter(e => {
        const impact = e.impact.toLowerCase();
        const title = e.title.toLowerCase();

        if (e.country === 'USD' && impact === 'high') return true;
        if (e.country === 'USD' && impact === 'medium') return true;
        if (e.country === 'USD' && title.includes('bank holiday')) return true;

        return false;
      });

      setEvents(filteredEvents);
    
    };

    fetchXML();
  }, []);

  const groupedEvents = groupEventsByDay(events);

  return (
    <div className="flex gap-4">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
        <Card key={day} className="w-64">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {day}
              <span className="text-xs text-muted-foreground font-normal">
                {groupedEvents[day][0] ? formatDate(groupedEvents[day][0].date) : ''}
              </span>
            </CardTitle>
          </CardHeader>
 <CardContent>
  {groupedEvents[day].length === 0 ? (
    <div className="text-muted-foreground text-sm">\</div>
  ) : (
    groupedEvents[day].map((e, idx) => {
      const nyTime = formatNYTime(e.date, e.time);
      return (
        <div key={idx} className="mb-2">
          {/* Time above */}
          {(nyTime || e.time) && (
            <div className="text-xs text-muted-foreground mb-0.5">
              {nyTime || e.time}
            </div>
          )}
          {/* Folder and title in a row */}
          <div className="flex items-center gap-2">
            <Folder className={`w-4 h-4 flex-shrink-0 ${getFolderColor(e)}`} />
            <span className="font-semibold">{e.title}</span>
          </div>
        </div>
      );
    })
  )}
</CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ForexCalendar;