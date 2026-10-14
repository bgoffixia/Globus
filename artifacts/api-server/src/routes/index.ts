import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bankRouter from "./bank";
import bankAdminRouter from "./bankAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bankRouter);
router.use(bankAdminRouter);

export default router;
