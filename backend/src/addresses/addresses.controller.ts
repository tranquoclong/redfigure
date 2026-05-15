import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { ViaCepService } from './viacep.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly viaCepService: ViaCepService,
  ) {}

  @Public()
  @Get('cep/:cep')
  async lookupCep(@Param('cep') cep: string) {
    return await this.viaCepService.lookup(cep);
  }

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    const addresses = await this.addressesService.findAll(user.id);
    return { data: addresses };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const address = await this.addressesService.findOne(id, user.id);
    return { data: address };
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAddressDto,
  ) {
    const address = await this.addressesService.create(user.id, dto);
    return { data: address };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAddressDto,
  ) {
    const address = await this.addressesService.update(id, user.id, dto);
    return { data: address };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.addressesService.remove(id, user.id);
    return { data: { message: 'Address deleted successfully' } };
  }
}
