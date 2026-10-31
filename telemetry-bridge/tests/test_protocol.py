import struct
import unittest

from protocol import HEADER, SIZES, parse_packet

def make_packet(packet_id):
    data = bytearray(SIZES[2026][packet_id])
    struct.pack_into("<H", data, 0, 2026)
    data[2] = 25
    data[5] = 1
    data[6] = packet_id
    data[27] = 0
    return data

class ProtocolTests(unittest.TestCase):
    def test_motion_world_position(self):
        data = make_packet(0)
        o = HEADER
        struct.pack_into("<fff", data, o, 123.5, 8.0, -456.25)
        result = parse_packet(data)
        self.assertEqual(result["worldX"], 123.5)
        self.assertEqual(result["worldY"], 8.0)
        self.assertEqual(result["worldZ"], -456.25)

    def test_player_telemetry_fields(self):
        data = make_packet(6)
        o = HEADER
        struct.pack_into("<H", data, o, 287)
        struct.pack_into("<f", data, o + 2, .75)
        data[o + 15] = 8
        struct.pack_into("<H", data, o + 16, 12000)
        data[o + 18] = 1
        result = parse_packet(data)
        self.assertEqual(result["speed"], 287)
        self.assertEqual(result["gear"], 8)
        self.assertEqual(result["rpm"], 12000)
        self.assertTrue(result["drs"])
        self.assertAlmostEqual(result["throttle"], .75)

    def test_lap_data_gaps_and_safety_delta(self):
        data = make_packet(2)
        o = HEADER
        struct.pack_into("<H", data, o + 14, 1234)
        data[o + 16] = 1
        struct.pack_into("<H", data, o + 17, 2400)
        struct.pack_into("<f", data, o + 28, -0.25)
        result = parse_packet(data)
        self.assertEqual(result["gapToCarAheadMs"], 61234)
        self.assertEqual(result["gapToLeaderMs"], 2400)
        self.assertAlmostEqual(result["scDelta"], -0.25)

    def test_active_aero_and_overtake_packet(self):
        data = make_packet(16)
        o = HEADER
        data[o] = 1
        data[o + 1] = 1
        data[o + 4] = 1
        data[o + 5] = 1
        data[o + 8] = 1
        result = parse_packet(data)
        self.assertEqual(result["activeAeroMode"], 1)
        self.assertTrue(result["activeAeroAvailable"])
        self.assertTrue(result["overtakeAvailable"])
        self.assertTrue(result["overtakeActive"])
        self.assertTrue(result["regulations2026Applicable"])

    def test_status_tyre_compound_and_ers(self):
        data = make_packet(7)
        o = HEADER
        struct.pack_into("<f", data, o + 37, 2_000_000)
        data[o + 25] = 18
        data[o + 26] = 17
        data[o + 27] = 3
        data[o + 41] = 2
        result = parse_packet(data)
        self.assertEqual(result["actualTyreCompound"], 18)
        self.assertEqual(result["visualTyreCompound"], 17)
        self.assertEqual(result["tyreAgeLaps"], 3)
        self.assertEqual(result["ersMode"], 2)
        self.assertAlmostEqual(result["ersPercent"], 50)

    def test_rejects_wrong_game_year(self):
        data = make_packet(6)
        data[2] = 24
        with self.assertRaises(ValueError):
            parse_packet(data)

    def test_rejects_wrong_size_and_version(self):
        with self.assertRaises(ValueError):
            parse_packet(bytes(SIZES[2026][6] - 1))
        data = make_packet(6)
        data[5] = 2
        with self.assertRaises(ValueError):
            parse_packet(data)

if __name__ == "__main__":
    unittest.main()
