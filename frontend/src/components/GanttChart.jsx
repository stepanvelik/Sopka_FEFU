import { useEffect, useRef } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';

const GanttChart = ({ items, groups, startDate, endDate, eventItems }) => {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (timelineRef.current) {
      timelineRef.current.destroy();
      timelineRef.current = null;
    }

    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const options = {
      start: start,
      end: end,
      editable: false,
      selectable: true,
      stack: true,
      showCurrentTime: true,
      zoomable: true,
      moveable: true,
      horizontalScroll: true,
      verticalScroll: true,
      orientation: 'top',
      format: {
        minorLabels: {
          hour: 'HH:00',
          day: 'DD.MM'
        }
      },
      timeAxis: { scale: 'hour', step: 1 },
      zoomKey: 'ctrlKey',
      zoomMin: 1000 * 60 * 60,
      zoomMax: 1000 * 60 * 60 * 24 * 7,
      height: '300px',
      margin: {
        item: 5,
        axis: 10
      }
    };

    const allItems = [...(eventItems || []), ...items];

    timelineRef.current = new Timeline(containerRef.current, allItems, groups, options);

    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [items, groups, startDate, endDate, eventItems]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '350px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' }}
    />
  );
};

export default GanttChart;