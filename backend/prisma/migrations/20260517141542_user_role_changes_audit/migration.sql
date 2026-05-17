-- CreateTable
CREATE TABLE "user_role_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromRole" "UserRole" NOT NULL,
    "toRole" "UserRole" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_role_changes_userId_idx" ON "user_role_changes"("userId");

-- CreateIndex
CREATE INDEX "user_role_changes_changedById_idx" ON "user_role_changes"("changedById");

-- CreateIndex
CREATE INDEX "user_role_changes_createdAt_idx" ON "user_role_changes"("createdAt");

-- AddForeignKey
ALTER TABLE "user_role_changes" ADD CONSTRAINT "user_role_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_changes" ADD CONSTRAINT "user_role_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
