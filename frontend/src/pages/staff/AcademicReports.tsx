
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, BookOpen, GraduationCap, ArrowUpRight, Award, Trophy, Star } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AcademicReports() {
    const data = [
        { name: 'Class 1-A', score: 85 },
        { name: 'Class 2-B', score: 78 },
        { name: 'Class 5-C', score: 92 },
        { name: 'Class 8-A', score: 88 },
        { name: 'Class 10-A', score: 83 },
    ];

    const topScorers = [
        { name: 'Aarav Sharma', class: 'Class 10-A', score: '98%', subject: 'Mathematics' },
        { name: 'Priya Reddy', class: 'Class 9-B', score: '97%', subject: 'Science' },
        { name: 'Ishita Gupta', class: 'Class 8-A', score: '96%', subject: 'Physics' },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Academic Reports</h1>
                    <p className="text-slate-500 font-medium">Performance analytics and student grades</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-100 rounded-3xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-indigo-900">Average Score</CardTitle>
                            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <BookOpen className="h-4 w-4 text-indigo-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-indigo-900">85.2%</div>
                            <p className="text-xs font-bold text-indigo-600 mt-2 flex items-center">
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                +2.1% from last term
                            </p>
                            <div className="h-1.5 w-full bg-indigo-200 rounded-full mt-4 overflow-hidden">
                                <div className="h-full w-[85%] bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-3xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-900">Promoted</CardTitle>
                            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <GraduationCap className="h-4 w-4 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-emerald-900">92</div>
                            <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center">
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                Students Passed
                            </p>
                            <div className="h-1.5 w-full bg-emerald-200 rounded-full mt-4 overflow-hidden">
                                <div className="h-full w-[92%] bg-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-100 rounded-3xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-900">Top Rankers</CardTitle>
                            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <Trophy className="h-4 w-4 text-amber-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-amber-900">12</div>
                            <p className="text-xs font-bold text-amber-600 mt-2 flex items-center">
                                <Star className="h-3 w-3 mr-1" />
                                Distinction Holders
                            </p>
                            <div className="h-1.5 w-full bg-amber-200 rounded-full mt-4 overflow-hidden">
                                <div className="h-full w-[65%] bg-amber-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white text-[#002147] p-6 lg:p-8">
                        <CardHeader className="pb-8 pl-4">
                            <CardTitle className="text-xl font-bold">Class Average Scores</CardTitle>
                            <CardDescription className="text-slate-400 font-medium">Comparison across different classes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={data}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="#94a3b8"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fontSize: 12, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}%`}
                                        tick={{ fontSize: 12, fontWeight: 700 }}
                                        dx={-10}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            fontWeight: 'bold',
                                            color: '#002147',
                                            padding: '12px 20px'
                                        }}
                                    />
                                    <Bar
                                        dataKey="score"
                                        fill="#002147"
                                        radius={[8, 8, 8, 8]}
                                        barSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg rounded-[2.5rem] bg-indigo-600 text-white overflow-hidden p-8 relative">
                        <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-bl-full -mr-12 -mt-12 blur-2xl" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                    <Award className="h-7 w-7 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black tracking-tight">Top Performers</CardTitle>
                                    <CardDescription className="text-indigo-200 mt-1">This term's highest achievers</CardDescription>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {topScorers.map((student, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold shadow-md text-sm">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg leading-tight">{student.name}</p>
                                                <p className="text-xs font-medium text-indigo-200 opacity-80 uppercase tracking-wider mt-0.5">{student.class} • {student.subject}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-black tracking-tight">{student.score}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-center mt-8">
                            <button className="text-xs font-bold uppercase tracking-widest bg-white/20 hover:bg-white hover:text-indigo-700 text-white px-6 py-3 rounded-xl transition-all w-full">View Full Leaderboard</button>
                        </div>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
