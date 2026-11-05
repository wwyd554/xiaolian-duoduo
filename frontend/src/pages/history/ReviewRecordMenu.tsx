import { useId, useRef, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { ApiService } from "../../services/ApiService";
import type { ReviewItem } from "../../types/reviews";

export default function ReviewRecordMenu({ item, onDeleted }: { item: ReviewItem; onDeleted: (id: string) => void }) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const deleteLock = useRef(false);
  const title = item.scenario_title || item.title;
  const close = () => {
    if (deleteLock.current) return;
    setConfirmOpen(false);
    setError("");
  };
  const remove = async () => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setError("");
    try {
      await ApiService.getInstance().deleteReview(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试");
      return;
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
    setConfirmOpen(false);
    onDeleted(item.id);
  };
  return <>
    <IconButton id={`${id}-trigger`} aria-label={`复盘操作：${title}`} aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? `${id}-menu` : undefined} onClick={(event) => setAnchor(event.currentTarget)} sx={{ width: 44, height: 44, color: "text.secondary" }}>
      <MoreHorizRounded />
    </IconButton>
    <Menu id={`${id}-menu`} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} slotProps={{ paper: { sx: { mt: .5, borderRadius: 2, minWidth: 156 } }, list: { "aria-labelledby": `${id}-trigger` } }}>
      <MenuItem onClick={() => { setAnchor(null); setError(""); setConfirmOpen(true); }} sx={{ color: "error.main", minHeight: 44 }}>
        <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineRounded fontSize="small" /></ListItemIcon>删除复盘
      </MenuItem>
    </Menu>
    <Dialog open={confirmOpen} onClose={close} maxWidth="xs" fullWidth aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <DialogTitle id={`${id}-title`}>删除这条复盘？</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-description`} sx={{ overflowWrap: "anywhere" }}>
          “{title}”及其原始对话、复盘报告将被永久删除，无法恢复。
          {item.status !== "completed" ? "进行中的练习也会一并结束。" : ""}
          {item.analysis_status === "pending" || item.analysis_status === "processing" ? "正在生成的复盘将停止保存。" : ""}
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} disabled={deleting} color="inherit">取消</Button>
        <Button onClick={() => void remove()} variant="contained" color="error" disabled={deleting} startIcon={deleting ? <CircularProgress color="inherit" size={16} /> : undefined}>{deleting ? "删除中…" : "确认删除"}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
