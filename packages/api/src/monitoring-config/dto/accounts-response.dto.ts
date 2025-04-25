import { ApiProperty } from '@nestjs/swagger';

export class AccountsResponseDto {
  @ApiProperty({
    description: 'Map of account addresses grouped by handler',
    example: {
      'validators-default': [
        '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
      ],
    },
  })
  accounts: Record<string, string[]>;
}
