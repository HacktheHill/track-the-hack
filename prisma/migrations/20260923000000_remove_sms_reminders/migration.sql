DROP TABLE `EventSmsSubscription`;
DROP TABLE `SmsVerification`;
DROP TABLE `SmsConsent`;
DROP TABLE `SmsContact`;
DROP TABLE `SmsSuppression`;
DROP TABLE `SmsDailyUsage`;

ALTER TABLE `Event` DROP COLUMN `smsNotifiedAt`;
