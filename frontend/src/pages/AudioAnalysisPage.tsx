import { useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";

/** Local backend has no durable audio-review pipeline yet. Do not mount legacy upload effects. */
export default function AudioAnalysisPage() {
  useEffect(() => {
    document.title = "录音复盘 | 销练多多";
  }, []);

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 4, md: 8 } }}>
        <Typography variant="h4" component="h1" gutterBottom>录音复盘</Typography>
        <Alert severity="info" sx={{ my: 3 }}>
          录音复盘暂未开放。当前版本尚未接通录音上传、转写和报告生成流程，因此暂不接受文件上传。
        </Alert>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          陪练中的麦克风口语输入仍可正常使用。完成练习后，可以在「陪练复盘」查看对话记录与分析报告。
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button component={Link} to="/history" variant="contained">查看陪练复盘</Button>
          <Button component={Link} to="/scenarios" variant="outlined">开始练习</Button>
        </Stack>
      </Box>
    </Container>
  );
}
