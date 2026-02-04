import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Line, Bar } from 'recharts';
import { LineChart, BarChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartCardProps {
  title: string;
  type: 'line' | 'bar';
  data: any[];
  dataKey: string;
  xAxisKey: string;
  color?: string;
  height?: number;
}

export default function ChartCard({
  title,
  type,
  data,
  dataKey,
  xAxisKey,
  color = "#6366f1",
  height = 200
}: ChartCardProps) {
  const ChartComponent = type === 'line' ? LineChart : BarChart;

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={data}>
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {type === 'line' ? (
              <Line
                type="monotone"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                dataKey={dataKey}
              />
            ) : (
              <Bar
                fill={color}
                radius={[4, 4, 0, 0]}
                dataKey={dataKey}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}