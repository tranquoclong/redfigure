"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Unlock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";

interface BanInfo {
  ip: string;
  reason: string;
  bannedAt: string;
  expiresAt: string;
  ttl: number;
}

interface AttemptLog {
  ip: string;
  reason: string;
  userAgent?: string;
  timestamp: string;
}

function formatTimeRemaining(ttl: number): string {
  if (ttl <= 0) return "Hết hạn";
  const h = Math.floor(ttl / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminSecurityPage() {
  const queryClient = useQueryClient();

  const { data: bans, isLoading: bansLoading } = useQuery({
    queryKey: ["admin", "security-bans"],
    queryFn: async () => {
      const { data } = await api.get("/admin/security/bans");
      return data.data as BanInfo[];
    },
    refetchInterval: 30000,
  });

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["admin", "security-attempts"],
    queryFn: async () => {
      const { data } = await api.get("/admin/security/attempts?limit=50");
      return data.data as AttemptLog[];
    },
    refetchInterval: 15000,
  });

  const unbanMutation = useMutation({
    mutationFn: (ip: string) => api.delete(`/admin/security/bans/${ip}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "security-bans"] });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Bảo mật</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        IP bị chặn sau khi vượt quá 10 lần đăng nhập hoặc đặt lại mật khẩu thất
        bại trong 15 phút. Bạn có thể mở khóa thủ công.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            IP bị chặn
            {bans && bans.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {bans.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bansLoading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : !bans?.length ? (
            <p className="text-muted-foreground py-4 text-center">
              Không có IP nào bị chặn.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Thời gian bị chặn</TableHead>
                    <TableHead>Thời gian hết hạn</TableHead>
                    <TableHead className="w-24">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bans.map((ban) => (
                    <TableRow key={ban.ip}>
                      <TableCell className="font-mono font-medium">
                        {ban.ip}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {ban.reason}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(ban.bannedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatTimeRemaining(ban.ttl)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unbanMutation.mutate(ban.ip)}
                          disabled={unbanMutation.isPending}
                          className="text-primary hover:text-primary"
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Hủy chặn
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lịch sử đăng nhập thất bại</CardTitle>
        </CardHeader>
        <CardContent>
          {attemptsLoading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : !attempts?.length ? (
            <p className="text-muted-foreground py-4 text-center">
              Không có IP nào bị chặn.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>User-Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt, i) => (
                    <TableRow key={`${attempt.ip}-${attempt.timestamp}-${i}`}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(attempt.timestamp)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {attempt.ip}
                      </TableCell>
                      <TableCell className="text-sm">
                        {attempt.reason}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {attempt.userAgent ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
