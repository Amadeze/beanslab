"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TenantGrowthChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2B7567" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2B7567" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#D8D3C8" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="#756F65" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis 
          stroke="#756F65" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => `${value}`} 
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#080B0C", 
            border: "1px solid rgba(255,255,255,0.12)", 
            borderRadius: "0",
            color: "#fff"
          }}
          itemStyle={{ color: "#A0E5D9" }}
        />
        <Area 
          type="monotone" 
          dataKey="tenants" 
          stroke="#2B7567" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorTenants)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
