import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Database, AlertCircle, CheckCircle2 } from "lucide-react";

export default function TableRegistryCheck() {
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTables() {
            setLoading(true);
            try {
                const tablesToCheck = [
                    'students', 
                    'classes', 
                    'course_payments', 
                    'books_payments', 
                    'transport_payments', 
                    'student_accessory_payments',
                    'accessories_payments',
                    'accessory_sales',
                    'accessory_categories',
                    'student_accessory_fees',
                    'profiles',
                    'user_roles'
                ];

                const results = await Promise.all(
                    tablesToCheck.map(async (tableName) => {
                        try {
                            const { error: checkError } = await supabase
                                .from(tableName)
                                .select('id', { count: 'exact', head: true })
                                .limit(1);
                            
                            return {
                                table_name: tableName,
                                exists: !checkError || (checkError.code !== '42703' && checkError.code !== '42P01'), // 42P01 is "relation does not exist"
                                error: checkError ? checkError.message : null,
                                code: checkError ? checkError.code : null
                            };
                        } catch (err: any) {
                            return {
                                table_name: tableName,
                                exists: false,
                                error: err.message || "Failed to query"
                            };
                        }
                    })
                );
                setTables(results);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchTables();
    }, []);

    return (
        <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center gap-3 mb-6">
                <Database className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-slate-900 font-display">Supabase Table Registry</h1>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                    <p className="text-slate-500 font-medium">Querying database schema...</p>
                </div>
            ) : error ? (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                        <div>
                            <h3 className="text-lg font-bold text-red-900">Schema Query Failed</h3>
                            <p className="text-red-700">{error}</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="shadow-xl overflow-hidden border-none rounded-2xl">
                    <CardHeader className="bg-white border-b border-slate-100">
                        <CardTitle className="text-xl text-slate-800">Available Tables in 'public'</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-700">Table Name</TableHead>
                                    <TableHead className="font-bold text-slate-700">Status</TableHead>
                                    <TableHead className="font-bold text-slate-700">System Message</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tables.map((t, i) => (
                                    <TableRow key={i} className="hover:bg-blue-50/50 transition-colors">
                                        <TableCell className="font-mono font-bold text-blue-700">{t.table_name}</TableCell>
                                        <TableCell>
                                            {t.exists ? (
                                                <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full w-fit">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span>Found</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-3 py-1 rounded-full w-fit">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <span>Missing</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500 italic max-w-md">
                                            {t.exists ? "Registered and accessible" : t.error || "No response from server"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
