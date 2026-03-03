'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Timer, Folder } from 'lucide-react';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { app } from '@/config/firebase';

const db = getFirestore(app);


const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatDate(monday)} - ${formatDate(friday)}`;
}

function getImpactColor(impact: string) {
  switch (impact.toLowerCase()) {
    case 'high':
      return '#dc2626'; // red-500
    case 'medium':
      return '#f97316'; // orange-500
    case 'gray':
      return '#6b7280'; // gray-500
    default:
      return '#6b7280';
  }
}

export function PieGraph() {
  const [newsData, setNewsData] = React.useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchNews = async () => {
      try {
     
        const newsCollection = collection(db, 'News');
        const querySnapshot = await getDocs(newsCollection);
      
        
        const data: { [key: string]: any[] } = {};
        querySnapshot.forEach((doc) => {
          const dayName = doc.id;
          const docData = doc.data();
        
          data[dayName] = docData.items || [];
        });
        
     
        setNewsData(data);
      } catch (error) {
      
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);
  return (
    <Card className="h-[466px]">
      <CardHeader>
        <CardTitle>News Calendar</CardTitle>
        <CardDescription className="flex items-center gap-2">
          Upcoming 🇺🇸 News, {getWeekDateRange()}
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[calc(100%-6rem)] p-3">
        <div className="h-full flex flex-col">
          <div className="flex gap-3 flex-1 ml-4">
            {/* Monday, Tuesday, Wednesday */}
            {days.slice(0, 3).map((day) => (
              <Card key={day} className="h-full w-[30%]">
                <CardHeader className="pb-2 pt-3 flex justify-center">
                  <CardTitle className="text-xs font-medium text-center">{day}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3 flex-1 space-y-2 overflow-y-auto">
                  {!loading && newsData[day] && newsData[day].length > 0 && (
                    newsData[day].map((news, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Folder 
                            className="h-4 w-4 flex-shrink-0" 
                            fill="none"
                            stroke={getImpactColor(news.impact)}
                            strokeWidth={2}
                          />
                          <span className="text-xs text-white">{news.time}</span>
                        </div>
                        <span className="text-xs text-white pl-6">{news.text}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex gap-3 mt-3 flex-1 justify-center">
            {/* Thursday and Friday - 2 cards centered */}
            {days.slice(3, 5).map((day) => (
              <Card key={day} className="h-full w-[30%]">
                <CardHeader className="pb-2 pt-3 flex justify-center">
                  <CardTitle className="text-xs font-medium text-center">{day}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3 flex-1 space-y-2 overflow-y-auto">
                  {!loading && newsData[day] && newsData[day].length > 0 && (
                    newsData[day].map((news, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Folder 
                            className="h-4 w-4 flex-shrink-0" 
                            fill="none"
                            stroke={getImpactColor(news.impact)}
                            strokeWidth={2}
                          />
                          <span className="text-xs text-white">{news.time}</span>
                        </div>
                        <span className="text-xs text-white pl-6">{news.text}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
