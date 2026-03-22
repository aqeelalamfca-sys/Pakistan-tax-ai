import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import engagementsRouter from "./engagements";
import uploadsRouter from "./uploads";
import validationRouter from "./validation";
import mappingRouter from "./mapping";
import rulesRouter from "./rules";
import computationRouter from "./computation";
import withholdingRouter from "./withholding";
import risksRouter from "./risks";
import reviewsRouter from "./reviews";
import aiRouter from "./ai";
import vaultRouter from "./vault";
import auditRouter from "./audit";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/engagements", engagementsRouter);
router.use("/uploads", uploadsRouter);
router.use("/validation", validationRouter);
router.use("/mapping", mappingRouter);
router.use("/rules", rulesRouter);
router.use("/computation", computationRouter);
router.use("/withholding", withholdingRouter);
router.use("/risks", risksRouter);
router.use("/reviews", reviewsRouter);
router.use("/ai", aiRouter);
router.use("/vault", vaultRouter);
router.use("/audit", auditRouter);
router.use("/users", usersRouter);

export default router;
