-- Preserve existing sizes and allow participants to decline a T-shirt.
ALTER TABLE `Hacker` MODIFY `tShirtSize` ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL', 'NONE') NOT NULL;
