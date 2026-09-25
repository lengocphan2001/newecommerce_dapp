"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";
import TreeCanvas from "./components/TreeCanvas";
import TreeLegend from "./components/TreeLegend";
import NodeDetailSheet from "./components/NodeDetailSheet";
import BranchListView, { ListBranch, ListMember } from "./components/BranchListView";
import TreeSkeleton from "./components/TreeSkeleton";
import { Branch, TreeNode, TreeResponse, countMembers } from "./components/treeUtils";

type ViewMode = "diagram" | "list";

interface PathItem {
  id: string | null;
  label: string;
}

const DEPTH_OPTIONS = [2, 3, 5];

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = parseFloat(String(value ?? "0"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toListBranch(raw: any, side: Branch): ListBranch {
  const members: ListMember[] = (raw?.members || []).map((member: any) => ({
    id: member.id || "",
    username: member.username || "",
    fullName: member.fullName || "",
    avatar: member.avatar,
    packageType: member.packageType || "NONE",
    position: side,
    totalPurchaseAmount: toNumber(member.totalPurchaseAmount),
    depth: member.depth || 1,
  }));
  return {
    members,
    volume: toNumber(raw?.volume),
    count: raw?.count || 0,
  };
}

/** Tìm node theo tên hoặc tài khoản trong phần cây đang tải. */
function findNode(node: TreeNode | null, keyword: string): TreeNode | null {
  if (!node) return null;
  const needle = keyword.trim().toLowerCase();
  if (!needle) return null;
  const username = (node.username || "").toLowerCase();
  const fullName = (node.fullName || "").toLowerCase();
  if (username.includes(needle) || fullName.includes(needle)) return node;
  for (const child of node.children || []) {
    const found = findNode(child, keyword);
    if (found) return found;
  }
  return null;
}

export default function BinaryTreeView() {
  const { t } = useI18n();
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<ViewMode>("diagram");
  const [depth, setDepth] = useState(3);
  const [path, setPath] = useState<PathItem[]>([{ id: null, label: "" }]);

  const [treeRes, setTreeRes] = useState<TreeResponse | null>(null);
  const [listData, setListData] = useState<{ left: ListBranch; right: ListBranch } | null>(null);
  const [myReferralCode, setMyReferralCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  const currentRootId = path[path.length - 1]?.id ?? null;

  // Trang chỉ dành cho người đã đăng nhập. Chặn ngay khi mount để không loé
  // nội dung trước lúc layout /home kịp điều hướng.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [info, tree] = await Promise.all([
          api.getReferralInfo(true),
          api.getMyTree(currentRootId || undefined, depth),
        ]);
        if (cancelled) return;
        setMyReferralCode(info?.referralCode || "");
        setTreeRes(tree as TreeResponse);
      } catch (err: any) {
        if (cancelled) return;
        if (handleAuthError(err, router)) return;
        setError(err?.message || "Không tải được cây nhị phân");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [authorized, currentRootId, depth, router]);

  // Danh sách hai cột lấy toàn bộ tuyến dưới, chỉ tải khi người dùng thật sự mở
  // tab đó vì truy vấn đệ quy này nặng hơn nhiều so với sơ đồ giới hạn theo cấp.
  useEffect(() => {
    if (!authorized || view !== "list" || listData || listLoading) return;
    let cancelled = false;

    const loadList = async () => {
      try {
        setListLoading(true);
        const downline = await api.getDownlineList();
        if (cancelled) return;
        setListData({
          left: toListBranch(downline?.left, "left"),
          right: toListBranch(downline?.right, "right"),
        });
      } catch (err: any) {
        if (cancelled) return;
        if (handleAuthError(err, router)) return;
        setError(err?.message || "Không tải được danh sách thành viên");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    };

    loadList();
    return () => {
      cancelled = true;
    };
  }, [authorized, view, listData, listLoading, router]);

  const goToInvite = useCallback(
    (branch: Branch) => {
      const query = myReferralCode ? `?ref=${encodeURIComponent(myReferralCode)}&leg=${branch}` : "";
      router.push(`/register${query}`);
    },
    [myReferralCode, router],
  );

  const drillDown = useCallback((node: TreeNode) => {
    setSelectedNode(null);
    setHighlightId(null);
    setSearchMessage("");
    setPath((prev) => [...prev, { id: node.id, label: node.username || node.fullName || "" }]);
  }, []);

  const goToPathIndex = useCallback((index: number) => {
    setSelectedNode(null);
    setHighlightId(null);
    setSearchMessage("");
    setPath((prev) => prev.slice(0, index + 1));
  }, []);

  const handleSearch = useCallback(() => {
    const keyword = searchQuery.trim();
    if (!keyword) return;

    if (view === "diagram") {
      const found = findNode(treeRes?.tree || null, keyword);
      if (!found) {
        setHighlightId(null);
        setSearchMessage(t("treeNotFound"));
        return;
      }
      setHighlightId(found.id);
      setSearchMessage("");
      window.requestAnimationFrame(() => {
        document
          .getElementById(`tree-node-${found.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      });
      return;
    }

    const needle = keyword.toLowerCase();
    const all = [...(listData?.left.members || []), ...(listData?.right.members || [])];
    const found = all.find(
      (m) => m.username.toLowerCase().includes(needle) || m.fullName.toLowerCase().includes(needle),
    );
    if (!found) {
      setHighlightId(null);
      setSearchMessage(t("treeNotFound"));
      return;
    }
    setHighlightId(found.id);
    setSearchMessage("");
    window.requestAnimationFrame(() => {
      document
        .getElementById(`tree-list-${found.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [searchQuery, view, treeRes, listData, t]);

  const canvasLabels = useMemo(
    () => ({
      you: t("treeYou"),
      emptySlot: t("treeEmptySlot"),
      zoomIn: t("treeZoomIn"),
      zoomOut: t("treeZoomOut"),
      reset: t("treeReset"),
      loadMore: t("treeLoadMore"),
    }),
    [t],
  );

  const visibleMembers = useMemo(() => countMembers(treeRes?.tree || null), [treeRes]);

  if (!authorized) {
    return <TreeSkeleton />;
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background-gray">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-100 bg-white/90 px-4 py-3 shadow-[0_1px_3px_rgba(37,99,235,0.05)] backdrop-blur-md">
        <button
          onClick={() => router.back()}
          className="-ml-2 flex items-center justify-center rounded-full p-2 transition-colors hover:bg-blue-50"
          aria-label={t("back") || "Quay lại"}
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center text-lg font-bold tracking-tight text-slate-900">
          {t("networkStructure")}
        </h1>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
          {(["diagram", "list"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setView(mode);
                setHighlightId(null);
                setSearchMessage("");
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                view === mode ? "bg-white text-primary shadow-sm" : "text-slate-500"
              }`}
            >
              {mode === "diagram" ? t("treeViewDiagram") : t("treeViewList")}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 pb-32">
        <div className="flex h-12 w-full items-stretch rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-center pl-4 text-gray-400">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            className="form-input flex-1 border-none bg-transparent text-base placeholder:text-gray-400 focus:ring-0"
            placeholder={t("searchMemberId")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchMessage("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <button onClick={handleSearch} className="px-4 text-sm font-semibold text-primary">
            {t("search")}
          </button>
        </div>
        {searchMessage && <p className="-mt-2 text-xs text-amber-600">{searchMessage}</p>}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {view === "diagram" ? (
          <>
            {/* Đường dẫn khi đang xem cây con của một thành viên tuyến dưới */}
            {path.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {path.map((item, index) => (
                  <React.Fragment key={`${item.id ?? "root"}-${index}`}>
                    {index > 0 && <span className="text-slate-300">/</span>}
                    <button
                      type="button"
                      onClick={() => goToPathIndex(index)}
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        index === path.length - 1 ? "bg-primary/10 text-primary" : "text-slate-500"
                      }`}
                    >
                      {index === 0 ? t("treeBackToRoot") : `@${item.label}`}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-500">{t("treeDepth")}</span>
                {DEPTH_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDepth(option)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      depth === option
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                {visibleMembers} {t("treeTotalMembers")}
              </span>
            </div>

            {loading ? (
              <TreeSkeleton />
            ) : treeRes ? (
              <>
                <TreeCanvas
                  root={treeRes.tree}
                  maxLevel={treeRes.maxDepth}
                  highlightId={highlightId}
                  labels={canvasLabels}
                  onNodeClick={setSelectedNode}
                  onEmptySlotClick={goToInvite}
                  onDrillDown={drillDown}
                />
                <TreeLegend
                  youLabel={t("treeLegendYou")}
                  team1Label={t("treeLegendTeam1")}
                  team2Label={t("treeLegendTeam2")}
                />
              </>
            ) : null}
          </>
        ) : listLoading || !listData ? (
          <TreeSkeleton />
        ) : (
          <BranchListView
            left={listData.left}
            right={listData.right}
            highlightId={highlightId}
            labels={{
              left: t("affiliateLeftBranchLabel"),
              right: t("affiliateRightBranchLabel"),
              members: t("members"),
              addMember: t("addMember"),
            }}
            onInvite={goToInvite}
          />
        )}
      </main>

      {selectedNode && (
        <NodeDetailSheet
          node={selectedNode}
          isRoot={selectedNode.id === treeRes?.tree.id}
          canDrillDown={selectedNode.id !== treeRes?.tree.id}
          labels={{
            title: t("treeMemberDetail"),
            joinedAt: t("treeJoinedAt"),
            personalVolume: t("treePersonalVolume"),
            team1Volume: t("treeTeam1Volume"),
            team2Volume: t("treeTeam2Volume"),
            viewMemberTree: t("treeViewMemberTree"),
            close: t("treeClose"),
          }}
          onClose={() => setSelectedNode(null)}
          onViewTree={drillDown}
        />
      )}
    </div>
  );
}
