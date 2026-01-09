-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "duration" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dayOfWeek" INTEGER NOT NULL,
    "workingHours" TEXT NOT NULL DEFAULT '[]',
    "isDayOff" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "workingHours" TEXT NOT NULL,
    "isDayOff" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT NOT NULL,
    "aboutText" TEXT NOT NULL,
    "aboutImage" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1621607512214-6c349036a732?q=80&w=1974&auto=format&fit=crop',
    "heroBackgroundType" TEXT NOT NULL DEFAULT 'IMAGE',
    "heroBackgroundValue" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-15993512021aa5a4858783?q=80&w=2070&auto=format&fit=crop',
    "locationAddress" TEXT NOT NULL,
    "locationSchedule" TEXT NOT NULL,
    "locationMapUrl" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colorAccent" TEXT NOT NULL DEFAULT '#CFAF7C',
    "colorBackground" TEXT NOT NULL DEFAULT '#0a0a0a',
    "colorTextMain" TEXT NOT NULL DEFAULT '#FFFFFF',
    "colorTextSubtle" TEXT NOT NULL DEFAULT '#cccccc'
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_dayOfWeek_key" ON "WorkSchedule"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleOverride_date_key" ON "ScheduleOverride"("date");
